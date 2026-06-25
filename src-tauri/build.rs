fn main() {
    // On macOS, EventKit requires the calendar usage descriptions to be present
    // in the binary's Info.plist. `tauri dev` runs an unbundled binary (no .app),
    // so we embed Info.plist directly into a __TEXT,__info_plist section. The
    // bundled .app uses its own generated Info.plist; this just makes dev work.
    #[cfg(target_os = "macos")]
    {
        let manifest_dir =
            std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
        let plist_path = format!("{manifest_dir}/Info.plist");
        if std::path::Path::new(&plist_path).exists() {
            println!("cargo:rerun-if-changed=Info.plist");
            println!(
                "cargo:rustc-link-arg=-Wl,-sectcreate,__TEXT,__info_plist,{plist_path}"
            );
        }
    }

    tauri_build::build()
}
