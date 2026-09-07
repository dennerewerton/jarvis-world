# Jarvis World — Square Cloud

This repository is the deploy root for the Jarvis World Discord Activity on
Square Cloud. Square Cloud starts `deploy/squarecloud-bootstrap/bootstrap.mjs`;
that bootstrap fetches the pinned public Webaverse runtime, applies the ordered
Jarvis patches, and then starts the HTTPS/WSS gateway.

The repository intentionally includes the Jarvis deployment configuration,
patch queue, and `city-assets/`. It does not vendor the upstream `app/` source
tree: the bootstrap fetches its recorded revision during deploy.

`public.env` only contains the public Discord client ID. Keep all backend
credentials and private keys in Square Cloud environment configuration, never
in this repository.

## Runtime vendor

`app/` is the upstream Webaverse runtime Git submodule pinned to the reproducible
commit recorded in `docs/jarvis-world/full-webaverse/upstream-baseline.md`.

Clone it together with its own dependencies:

```text
git submodule update --init --recursive webaverse/app
```

Do not edit the pinned upstream snapshot without recording the change in the
ordered patch queue. Small Jarvis compatibility adapters applied by those
patches may live under `app/src/jarvis-compat/`; larger Jarvis-owned bridges and
deployment configuration stay alongside the submodule.

FW-4 uses `deploy/nginx-fw4.conf.example` as the HTTPS/WSS reverse-proxy
contract. The public root goes to the Webaverse HTTP process and `/worlds/`
goes to its adjacent realtime process on the same public hostname.

Hosts without Nginx may run the dependency-free Node gateway instead:

```text
node webaverse/deploy/https-gateway.mjs
node webaverse/scripts/smoke-activity-host.mjs --origin https://ACTIVITY_HOST
```

Copy the names from `deploy/runtime.env.example` into the private runtime
environment. Never commit the TLS private key or any Discord/Jarvis secret.

Square Cloud can provide the stable HTTPS/WSS edge on its single public port.
`deploy/squarecloud-start.mjs` runs the private Webaverse listeners on
3100/3101 and the gateway on Square's `PORT`. The small bootstrap deployment
clones the pinned Git tag into persistent application storage, applies the
ordered patches and installs the historical dependency graph:

```text
powershell -File webaverse/scripts/build-squarecloud-bootstrap.ps1
```

Upload only the generated ZIP. It contains the public Discord client ID and no
backend secret; the full runtime is fetched from the public pinned repository.
For GitHub monorepo import, use `webaverse` as the root; its dependency-free
`package.json` and root `squarecloud.app` delegate to the same bootstrap. The deployment clones only the
pinned public Webaverse upstream; Jarvis patches come from the authenticated
Square Cloud repository import, so no private Git credential enters the app.
