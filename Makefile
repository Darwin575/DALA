RUST_DIR = rust_engine
BLAZOR_DIR = BlazorHost
WASM_OUT = $(BLAZOR_DIR)/wwwroot/js/rust_engine

.PHONY: build-rust copy-wasm build-blazor run clean

build-rust:
	cd $(RUST_DIR) && wasm-pack build --target web

copy-wasm:
	powershell -Command "if (!(Test-Path $(WASM_OUT))) { New-Item -ItemType Directory -Path $(WASM_OUT) -Force }"
	powershell -Command "Copy-Item $(RUST_DIR)/pkg/* $(WASM_OUT) -Recurse -Force"

build-blazor:
	cd $(BLAZOR_DIR) && dotnet build

run:
	cd $(BLAZOR_DIR) && dotnet watch

all: build-rust copy-wasm build-blazor
