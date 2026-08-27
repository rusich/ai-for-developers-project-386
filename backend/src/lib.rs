pub mod auth;
pub mod cors;
pub mod error;
pub mod handlers;
pub mod models;
pub mod slots;
pub mod state;

use axum::extract::DefaultBodyLimit;
use axum::middleware::from_fn;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;

use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/api/event-types", get(handlers::list_event_types).post(handlers::create_event_type))
        .route(
            "/api/event-types/{id}",
            get(handlers::get_event_type)
                .put(handlers::update_event_type)
                .delete(handlers::delete_event_type),
        )
        .route("/api/event-types/{id}/slots", get(handlers::get_slots))
        .route("/api/bookings", post(handlers::create_booking).get(handlers::list_bookings))
        .fallback(not_found)
        .layer(from_fn(cors::cors_layer))
        .layer(DefaultBodyLimit::max(64 * 1024))
        .with_state(state)
}

async fn not_found() -> Response {
    crate::error::ApiError::NotFound("Ресурс не найден.".to_string()).into_response()
}
