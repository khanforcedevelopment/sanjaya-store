# Sanjaya Store

Online store of Sanjaya Trading FZE for the Indian market: electronics, fashion, footwear, watches, bags and lifestyle, delivered from Mumbai.

- **Status:** see [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **How it is built:** see [ARCHITECTURE.md](ARCHITECTURE.md)
- **How to deploy:** see [DEPLOYMENT.md](DEPLOYMENT.md)
- **Requirements:** see [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)

## Developer quick start

```
npm ci
cp .env.example .env.local   # public values only
npm run dev                  # http://localhost:5173
npm run check                # typecheck, lint, tests, build, secret scan
```

`npm run build` writes the drag-and-drop folder to `dist/`.
