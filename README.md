# ConfigMedic

ConfigMedic is a browser-native SvelteKit configuration debugger for Kubernetes/K3s YAML, Docker Compose, NixOS, and Nginx/reverse-proxy configs.

## Run locally

```bash
./dev.sh
```

Or run the commands directly:

```bash
npm install
npm run dev
```

The built-in checks run immediately in the browser. Click **Load local AI** to download a WebLLM model to the browser cache and enable a deeper local review. No model API key or application backend is required.

Config type is detected automatically from the pasted file. You can still choose a format manually when reviewing an unusual or partial config.

## Deploy to Railway

This repo includes a `Dockerfile` and `railway.toml`. Create a Railway service from the repository and deploy; Railway will build the image and provide `PORT` to the Bun server.

```bash
npm run build
npm run start
```

Model weights are fetched by the browser from WebLLM's model catalog when the visitor opts into local AI. The server only serves the static application.
