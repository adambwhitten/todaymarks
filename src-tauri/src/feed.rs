//! Publish the local calendar's ICS as a secret GitHub Gist via the `gh` CLI,
//! giving a stable public URL that Cal.com (and others) can subscribe to.

use crate::models::CalendarEvent;
use std::io::Write;
use std::process::{Command, Stdio};

const FILE_NAME: &str = "todaymarks.ics";

/// GUI apps don't inherit the shell PATH, so look for `gh` in common spots.
fn find_gh() -> Option<String> {
    for p in [
        "/opt/homebrew/bin/gh",
        "/usr/local/bin/gh",
        "/opt/local/bin/gh",
        "/usr/bin/gh",
    ] {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    Some("gh".to_string())
}

fn gh_api(
    gh: &str,
    method: &str,
    path: &str,
    body: &str,
) -> Result<serde_json::Value, String> {
    let mut child = Command::new(gh)
        .args(["api", "--method", method, path, "--input", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!("Couldn't run GitHub CLI: {e}. Install it with `brew install gh` and run `gh auth login`.")
        })?;
    {
        let mut stdin = child.stdin.take().ok_or("no stdin")?;
        stdin.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("GitHub error: {}", err.trim()));
    }
    serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
}

/// Create or update the feed gist. Returns (gist_id, owner_login).
pub fn publish(
    events: &[CalendarEvent],
    existing_gist_id: Option<&str>,
) -> Result<(String, String), String> {
    let gh = find_gh().ok_or("GitHub CLI (gh) not found")?;
    let ics = crate::ics::generate("Todaymarks", events);

    let files_body = serde_json::json!({
        "files": { FILE_NAME: { "content": ics } }
    })
    .to_string();

    let create_body = serde_json::json!({
        "public": false,
        "description": "Todaymarks calendar feed",
        "files": { FILE_NAME: { "content": ics } }
    })
    .to_string();

    let resp = match existing_gist_id {
        Some(id) => match gh_api(&gh, "PATCH", &format!("/gists/{id}"), &files_body) {
            Ok(r) => r,
            // The gist may have been deleted — fall back to creating a new one.
            Err(_) => gh_api(&gh, "POST", "/gists", &create_body)?,
        },
        None => gh_api(&gh, "POST", "/gists", &create_body)?,
    };

    let id = resp
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("No gist id returned")?
        .to_string();
    let login = resp
        .get("owner")
        .and_then(|o| o.get("login"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    Ok((id, login))
}

/// Stable, auto-updating raw URL for the feed.
pub fn raw_url(login: &str, gist_id: &str) -> String {
    format!("https://gist.githubusercontent.com/{login}/{gist_id}/raw/{FILE_NAME}")
}

/// Delete the feed gist.
pub fn delete(gist_id: &str) -> Result<(), String> {
    let gh = find_gh().ok_or("GitHub CLI (gh) not found")?;
    let out = Command::new(&gh)
        .args(["api", "--method", "DELETE", &format!("/gists/{gist_id}")])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(())
}
