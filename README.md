# Algorithms-FinalProject

Starter full-stack web app for a future algorithm-based project.

## Stack

- Frontend: React (functional components) + Vite
- Backend: Node.js + Express

## Project Structure

```text
.
├── client
│   ├── src
│   │   ├── App.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server
│   ├── src
│   │   └── index.js
│   └── package.json
└── package.json
```

## Setup

1. Install dependencies from the root:

```bash
npm install
```

## Run

Start frontend and backend together from the root:

```bash
npm run dev
```

The apps run on:

- Frontend: http://localhost:5173
- Backend: http://localhost:5001
- Test API route: http://localhost:5001/api/test

## Available Scripts

From the root:

- `npm run dev` - Run both server and client
- `npm run dev:server` - Run backend only
- `npm run dev:client` - Run frontend only
- `npm run build` - Build frontend
- `npm run start` - Start backend in non-dev mode

## Integration Note

The frontend calls `/api/test` on load and logs the JSON response to the browser console.