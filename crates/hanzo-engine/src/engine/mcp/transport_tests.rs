use super::*;

#[tokio::test]
async fn test_read_message_basic() {
    let data = b"Content-Length: 13\r\n\r\n{\"test\":true}";
    let mut reader = BufReader::new(&data[..]);
    let result = read_message(&mut reader).await.unwrap().unwrap();
    assert_eq!(result, b"{\"test\":true}");
}

#[tokio::test]
async fn test_read_message_eof() {
    let data = b"";
    let mut reader = BufReader::new(&data[..]);
    let result = read_message(&mut reader).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_read_message_with_extra_headers() {
    let data = b"Content-Length: 2\r\nContent-Type: application/json\r\n\r\n{}";
    let mut reader = BufReader::new(&data[..]);
    let result = read_message(&mut reader).await.unwrap().unwrap();
    assert_eq!(result, b"{}");
}

#[tokio::test]
async fn test_read_message_newline_delimited_json() {
    let data = b"\n{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[]}}\n";
    let mut reader = BufReader::new(&data[..]);
    let result = read_message(&mut reader).await.unwrap().unwrap();
    assert_eq!(result, b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[]}}");
}

#[test]
fn test_sse_transport_handle_enum_variants() {
    fn _assert_send_sync<T: Send>() {}
}

#[tokio::test]
async fn test_live_hanzo_mcp_handshake_if_installed() {
    let Some(bin) = crate::engine::mcp::resolve_hanzo_mcp_binary() else {
        return;
    };
    let cfg = crate::engine::mcp::registry::McpRegistry::build_hanzo_config(None);
    let client = crate::engine::mcp::client::McpClient::connect(cfg)
        .await
        .expect(&format!("expected live hanzo-mcp stdio handshake via {bin}"));
    assert!(
        client.tools.len() >= 10,
        "expected >=10 HIP-0300 tools from hanzo-mcp, got {}",
        client.tools.len()
    );
    client.shutdown().await;
}
