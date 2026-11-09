# In-App Survey Engine - Spring Boot Backend Server

A high-performance Spring Boot 3.x (Java 21) backend server for the **In-App Survey Engine & Flowchart Studio**.

---

## 🛠 Tech Stack

- **Java 21 LTS** (Records, Virtual Threads, Pattern Matching)
- **Spring Boot 3.3.5**
  - `spring-boot-starter-web` (REST API & CORS)
  - `spring-boot-starter-data-jpa` (Hibernate 6 with PostgreSQL)
  - `spring-boot-starter-validation`
- **PostgreSQL / Supabase** (with JSONB support for React Flow nodes, edges, and metadata)
- **Jackson** (`JsonNode` handling for arbitrary flowchart graph definitions)
- **Build Support**:
  - **Maven** (`pom.xml` + `./mvnw` wrapper)
  - **Gradle** (`build.gradle` + `settings.gradle`)

---

## 🚀 Getting Started

### 1. Database Configuration

The application reads from `.env` in `server-spring/`, `../server/`, or `../`:

```properties
# Server Port
PORT=8080

# Supabase or local PostgreSQL URL:
DATABASE_URL=postgresql://user:password@host:5432/database
```

The Spring Boot backend will automatically convert standard PostgreSQL connection strings to JDBC format (`jdbc:postgresql://...`) and configure connection pooling and SSL mode.

### 2. Run the Server

#### Using Maven Wrapper:
```bash
cd server-spring
./mvnw spring-boot:run
```

#### Or using Gradle:
```bash
cd server-spring
gradle bootRun
```

The server starts on `http://localhost:8080`.

---

## 🔌 Connecting the Frontend

In the root repository's `vite.config.ts`, update the proxy target to port `8080`:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // Pointing to Spring Boot
        changeOrigin: true,
      },
    },
  },
});
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & database connection probe |
| `GET` | `/api/projects` | Get all flowchart survey projects |
| `GET` | `/api/projects/{id}` | Get project by ID (includes historical versions) |
| `POST` | `/api/projects` | Create a new flowchart survey project |
| `PUT` | `/api/projects/{id}` | Update project canvas (nodes, edges, group metadata) |
| `DELETE`| `/api/projects/{id}` | Delete a flowchart survey project |
| `POST` | `/api/projects/{id}/duplicate` | Duplicate an existing project |
| `POST` | `/api/projects/{id}/versions` | Create a published or draft version snapshot |
| `POST` | `/api/projects/{id}/versions/{versionId}/restore` | Restore project canvas to a previous version |
| `GET` | `/api/groups` | List all reusable question groups |
| `GET` | `/api/groups/{id}` | Get reusable group by ID |
| `POST` | `/api/groups` | Create reusable question group |
| `PUT` | `/api/groups/{id}` | Update reusable question group |
| `DELETE`| `/api/groups/{id}` | Delete reusable question group |
| `POST` | `/api/groups/reset` | Reset question groups to default KYC seeds |
| `POST` | `/api/compiler/compile` | Compile flowchart nodes & edges to Dynamic KYC JSON |
| `POST` | `/api/compiler/validate` | Diagnostic topology checks (unreachable nodes, decision branches) |

