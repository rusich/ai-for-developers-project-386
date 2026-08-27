use call_booking_backend::{build_router, state::new_state};

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let app = build_router(new_state());

    let listener = tokio::net::TcpListener::bind(&addr).await.expect("bind failed");
    println!("Backend API на http://{addr}");
    axum::serve(listener, app).await.expect("server error");
}
