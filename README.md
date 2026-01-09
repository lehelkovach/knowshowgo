# knowshowgo

This repository is currently a minimal monorepo scaffold for the **KnowShowGo MVP**:

- `packages/service`: HTTP API service (Fastify)
- `packages/api-client`: TypeScript API client that talks to the service

## Quickstart

```bash
npm install
npm test
npm run dev
```

The service runs on `http://0.0.0.0:3000` by default.

## Service API (current)

- `GET /healthz`
- `GET /v1/items`
- `POST /v1/items` body: `{ "title": string, "content"?: string }`
- `GET /v1/items/:id`
- `PATCH /v1/items/:id` body: `{ "title"?: string, "content"?: string }`
- `DELETE /v1/items/:id`

## Notes

There was no handoff/spec available in-repo (only an initial commit). This scaffold is intended to be a working base to iterate from once the actual MVP feature list and domain model are provided.