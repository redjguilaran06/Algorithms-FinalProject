import express from "express";

const app = express();
const PORT = 5001;

app.use(express.json());

app.get("/api/test", (_request, response) => {
  response.json({ message: "API is working" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});