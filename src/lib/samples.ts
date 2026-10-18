import type { ConfigExample, ConfigType } from './types';

export const examples: ConfigExample[] = [
  {
    id: 'k8s-deployment-drift',
    type: 'kubernetes',
    label: 'Deployment selector drift',
    description: 'A selector mismatch, a moving image tag, and no resources.',
    language: 'yaml',
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  labels:
    app: storefront
spec:
  replicas: 2
  selector:
    matchLabels:
      app: storefront-api
  template:
    metadata:
      labels:
        app: storefront
    spec:
      containers:
        - name: storefront
          image: ghcr.io/acme/storefront:latest
          ports:
            - containerPort: 8080
`,
  },
  {
    id: 'k3s-ingress',
    type: 'kubernetes',
    label: 'K3s Ingress',
    description: 'A small Traefik ingress manifest for a local K3s cluster.',
    language: 'yaml',
    code: `# k3s local cluster
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storefront
  namespace: demo
spec:
  ingressClassName: traefik
  rules:
    - host: storefront.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storefront
                port:
                  number: 80
`,
  },
  {
    id: 'k8s-service',
    type: 'kubernetes',
    label: 'Service + deployment',
    description: 'A clean pair of resources to compare against the broken example.',
    language: 'yaml',
    code: `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - name: http
      port: 80
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
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
          image: ghcr.io/acme/api:1.4.2
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
`,
  },
  {
    id: 'k8s-bad-yaml',
    type: 'kubernetes',
    label: 'Broken YAML indentation',
    description: 'A tiny parse error that is easy to spot in the editor.',
    language: 'yaml',
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
 replicas: 1
  selector:
    matchLabels:
      app: worker
`,
  },
  {
    id: 'compose-dependencies',
    type: 'compose',
    label: 'Missing Compose dependency',
    description: 'The web service waits for a database that is not declared.',
    language: 'yaml',
    code: `services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      API_URL: http://api:8080
    depends_on:
      - api
      - db
  api:
    image: ghcr.io/acme/api:1.2.0
    depends_on:
      - postgres
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_DB: app
      POSTGRES_PASSWORD: change-me
`,
  },
  {
    id: 'compose-local-stack',
    type: 'compose',
    label: 'Local app stack',
    description: 'A common web, API, and database setup with a floating Redis tag.',
    language: 'yaml',
    code: `services:
  web:
    image: node:22-bookworm
    working_dir: /workspace
    command: npm run dev -- --host 0.0.0.0
    volumes:
      - .:/workspace
    ports:
      - "5173:5173"
    depends_on:
      - api
  api:
    image: ghcr.io/acme/api:2.1.0
    environment:
      DATABASE_URL: postgres://app:devpass@db:5432/app
    depends_on:
      - db
  db:
    image: postgres:16
  cache:
    image: redis:latest
`,
  },
  {
    id: 'compose-parse-error',
    type: 'compose',
    label: 'Compose parse error',
    description: 'An unfinished inline list leaves the YAML document invalid.',
    language: 'yaml',
    code: `services:
  api:
    image: ghcr.io/acme/api:1.0.0
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/app
      FEATURE_FLAGS: [auth, billing
  db:
    image: postgres:16
`,
  },
  {
    id: 'compose-clean',
    type: 'compose',
    label: 'Pinned production stack',
    description: 'A clean Compose file with explicit versions and dependencies.',
    language: 'yaml',
    code: `services:
  api:
    image: ghcr.io/acme/api:2.4.1
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://app@db:5432/app
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16.4
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5
`,
  },
  {
    id: 'nixos-web-server',
    type: 'nixos',
    label: 'NixOS web server',
    description: 'Nginx is enabled, but the firewall and a secret need attention.',
    language: 'nix',
    code: `{ config, pkgs, ... }:

{
  networking.hostName = "edge-01";
  services.nginx.enable = true;
  services.myapp.password = "replace-me-in-source";

  environment.systemPackages = with pkgs; [
    git
    curl
  ];
}
`,
  },
  {
    id: 'nixos-secret',
    type: 'nixos',
    label: 'Inline Nix secret',
    description: 'A tempting application password that should live in a secret manager.',
    language: 'nix',
    code: `{ config, pkgs, ... }:

{
  services.postgresql.enable = true;
  services.postgresql.ensureUsers = [
    {
      name = "app";
      password = "super-secret-password";
    }
  ];
  environment.systemPackages = with pkgs; [ postgresql ];
}
`,
  },
  {
    id: 'nixos-incomplete',
    type: 'nixos',
    label: 'Incomplete Nix module',
    description: 'A missing closing brace is enough to stop a rebuild.',
    language: 'nix',
    code: `{ config, pkgs, ... }:

{
  boot.loader.systemd-boot.enable = true;
  networking.hostName = "configmedic";
  environment.systemPackages = with pkgs; [
    vim
    git
  ];
`,
  },
  {
    id: 'nix-dev-shell',
    type: 'nixos',
    label: 'Nix development shell',
    description: 'A clean flake-free shell for a Node and PostgreSQL project.',
    language: 'nix',
    code: `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_22
    postgresql
  ];
  shellHook = ''
    echo "ConfigMedic dev shell"
  '';
}
`,
  },
  {
    id: 'nginx-tls-proxy',
    type: 'nginx',
    label: 'TLS proxy without redirect',
    description: 'HTTP stays open and the upstream loses the original scheme.',
    language: 'nginx',
    code: `server {
  listen 80;
  listen 443 ssl;
  server_name app.example.com;

  ssl_certificate /etc/ssl/app.crt;
  ssl_certificate_key /etc/ssl/app.key;

  location / {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
`,
  },
  {
    id: 'nginx-missing-server',
    type: 'nginx',
    label: 'Location without server',
    description: 'A copied location block is missing its parent server block.',
    language: 'nginx',
    code: `location /api/ {
  proxy_pass http://api:8080;
  proxy_set_header Host $host;
}
`,
  },
  {
    id: 'nginx-upstream',
    type: 'nginx',
    label: 'Upstream load balancer',
    description: 'A clean reverse proxy with two application backends.',
    language: 'nginx',
    code: `upstream app_cluster {
  server app-1:3000;
  server app-2:3000;
}

server {
  listen 80;
  server_name app.example.com;

  location / {
    proxy_pass http://app_cluster;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`,
  },
  {
    id: 'nginx-static-and-api',
    type: 'nginx',
    label: 'Static site + API',
    description: 'A split between cached assets and an API upstream.',
    language: 'nginx',
    code: `server {
  listen 80;
  server_name docs.example.com;

  root /srv/docs;

  location /assets/ {
    expires 7d;
    try_files $uri =404;
  }

  location /api/ {
    proxy_pass http://api:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`,
  },
];

const primaryExample = (type: ConfigType) => examples.find((example) => example.type === type)!;

export const samples: Record<ConfigType, ConfigExample> = {
  kubernetes: primaryExample('kubernetes'),
  compose: primaryExample('compose'),
  nixos: primaryExample('nixos'),
  nginx: primaryExample('nginx'),
};
