#![windows_subsystem = "windows"]

fn main() {
    // Khởi tạo logger
    env_logger::init();

    // Chạy ứng dụng
    mun_sdk_ai_v2_lib::run();
}
