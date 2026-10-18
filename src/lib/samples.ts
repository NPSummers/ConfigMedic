import type { ConfigType } from './types';

export const samples: Record<ConfigType, { label: string; language: string; code: string }> = {
  kubernetes: {
    label: 'Kubernetes Deployment',
    language: 'yaml',
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/api:latest
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
`,
  },
  compose: {
    label: 'Docker Compose',
    language: 'yaml',
    code: `services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      API_URL: http://api:8080
    depends_on:
      - api
  api:
    image: ghcr.io/acme/api:latest
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/app
    depends_on:
      - db
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
`,
  },
  nixos: {
    label: 'NixOS Configuration',
    language: 'nix',
    code: `{ config, pkgs, ... }:

{
  boot.loader.systemd-boot.enable = true;
  networking.hostName = "configmedic";
  time.timeZone = "America/New_York";

  services.nginx = {
    enable = true;
    virtualHosts."_" = {
      locations."/".proxyPass = "http://127.0.0.1:3000";
    };
  };

  environment.systemPackages = with pkgs; [
    git
    curl
  ];
}
`,
  },
  nginx: {
    label: 'Reverse Proxy',
    language: 'nginx',
    code: `server {
  listen 80;
  server_name app.example.com;

  location / {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`,
  },
};
