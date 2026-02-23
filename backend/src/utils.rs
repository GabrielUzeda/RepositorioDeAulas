use deunicode::deunicode;

pub fn sanitize_slug(s: &str) -> String {
    let deunicoded = deunicode(s);
    
    deunicoded
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .split('_')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("_")
}

pub fn sanitize_path_or_url(s: &str) -> String {
    let deunicoded = deunicode(s);
    
    deunicoded
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || "-/._:?&#=%+@".contains(c) { c } else { '_' })
        .collect::<String>()
        .split('_')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("_")
}
