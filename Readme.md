# Cognigen Backend

Backend service for **Cognigen**, an AI-powered personalized learning platform. This service manages authentication, profile management, learning path orchestration, notebook-style learning content, quiz generation, progress tracking, and communication with the AI generation service.

---

# Overview

The Cognigen Backend acts as the central orchestration layer between:

- Frontend client
- MongoDB database
- AI service (FastAPI + LangGraph + Ollama)

It handles:

- User authentication & profile management
- Learning path lifecycle management
- Topic & submodule CRUD operations
- AI-generated learning content
- Mini quiz generation
- Progress tracking
- Notebook-like learning cells
- User leaderboard & statistics

---

# Features

## Authentication & User Management

- User Signup/Login
- JWT Authentication (Cookie-based)
- Profile Update
- Password Change
- Account Deletion
- Current User Session Retrieval
- Logout Support

## Learning Path Management

- Generate AI-based personalized learning paths
- Create custom topics
- Topic CRUD operations
- Submodule CRUD operations
- Topic reordering
- Submodule reordering
- Progress tracking
- Completion tracking

## AI Integration

Backend integrates with a separate AI microservice to:

- Generate learning paths
- Generate topic learning content
- Generate mini quizzes

## Notebook-style Learning System

Each submodule contains notebook-like cells:

- Markdown
- Code
- Resources
- Images
- Diagrams
- Separators

Supports:

- Add cell
- Update cell
- Delete cell

## Analytics

- Leaderboard generation
- User progress statistics
- Course completion tracking

---

# System Architecture

```text
Frontend (React / Vite)
        │
        ▼
Node.js + Express Backend
        │
        ├── MongoDB (Persistence)
        │
        └── FastAPI AI Service
                │
                ├── Learning Path Generation
                ├── Topic Content Generation
                └── Mini Quiz Generation
```

---

# Tech Stack

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcryptjs
- Cookie Parser
- Axios
- CORS

## AI Communication

- FastAPI (Microservice)
- REST API Communication using Axios

---

# Project Structure

```text
cognigen-backend/
│
├── controllers/
│   ├── authController.js
│   └── learningPathController.js
│
├── middleware/
│   └── authMiddleware.js
│
├── models/
│   ├── User.js
│   └── LearningPath.js
│
├── routes/
│   ├── authRoutes.js
│   └── learningPathRoutes.js
│
├── services/
│   └── aiService.js
│
├── .env
├── server.js
│
└── package.json
```

---

# Environment Variables

Create a `.env` file in the project root.

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/cognigen
JWT_SECRET=MASS_SECRET_KEY
JWT_EXPIRE=7d
AI_SERVICE_URL=http://localhost:8000
```

---

# Installation

## 1. Clone Repository

```bash
git clone <repository-url>
cd cognigen-backend
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create `.env`

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/cognigen
JWT_SECRET=MASS_SECRET_KEY
JWT_EXPIRE=7d
AI_SERVICE_URL=http://localhost:8000
```

## 4. Start MongoDB

Ensure MongoDB is running locally.

```bash
mongod
```

## 5. Start AI Service

The backend depends on the Cognigen AI service.

Start FastAPI server:

```bash
uvicorn main:app --reload
```

Default:

```text
http://localhost:8000
```

## 6. Run Backend

```bash
npm run dev
```

or

```bash
node server.js
```

Backend runs on:

```text
http://localhost:5000
```

---

# Authentication Flow

Authentication is implemented using **JWT stored in HTTP-only cookies**.

### Flow

```text
Login / Signup
      │
      ▼
Generate JWT Token
      │
      ▼
Store in HTTP-only Cookie
      │
      ▼
Protected Routes
      │
      ▼
authMiddleware verifies token
```

### Security Features

- Password hashing using bcrypt
- HTTP-only cookies
- JWT token verification
- Protected middleware routes

---

# Database Models

## User Model

Stores user account information.

### Fields

| Field    | Type   |
| -------- | ------ |
| name     | String |
| email    | String |
| password | String |
| phone    | String |

### Features

- Password hashing using bcrypt
- Password comparison helper method

---

## LearningPath Model

Stores personalized learning journeys.

### Structure

```text
LearningPath
│
├── Topics[]
│      ├── Submodules[]
│      │       ├── Cells[]
│      │       └── MiniQuiz[]
│
├── Progress Tracking
└── Status
```

### Core Fields

| Field                  | Description                        |
| ---------------------- | ---------------------------------- |
| title                  | Learning path title                |
| courseName             | Course name                        |
| experienceLevel        | Beginner / Intermediate / Advanced |
| goal                   | Placement / Mastery / Revision     |
| preferredLearningStyle | Theory / Practical / Mixed         |
| topics                 | Learning modules                   |
| overallProgress        | Completion percentage              |
| status                 | Draft / Active / Completed         |

---

# Notebook Cell System

Submodules use notebook-style cells.

### Supported Cell Types

```text
markdown
code
resource
image
diagram
separator
```

Example:

```json
{
  "type": "markdown",
  "content": "# Introduction to JavaScript"
}
```

---

# API Endpoints

## Authentication Routes

Base URL:

```text
/api/auth
```

| Method | Endpoint         | Description            |
| ------ | ---------------- | ---------------------- |
| POST   | /signup          | Register user          |
| POST   | /login           | Login user             |
| PUT    | /update-profile  | Update profile         |
| PUT    | /change-password | Change password        |
| DELETE | /delete-account  | Delete account         |
| GET    | /leaderboard     | Global leaderboard     |
| GET    | /stats           | User stats             |
| GET    | /me              | Current logged-in user |
| POST   | /logout          | Logout user            |

---

## Learning Path Routes

Base URL:

```text
/api/learning-paths
```

### Core Learning Path

| Method | Endpoint  | Description             |
| ------ | --------- | ----------------------- |
| POST   | /generate | Generate learning path  |
| GET    | /         | Get user learning paths |
| GET    | /:id      | Get learning path       |
| PATCH  | /:id      | Update learning path    |
| DELETE | /:id      | Delete learning path    |

---

### Topic CRUD

| Method | Endpoint             |
| ------ | -------------------- |
| POST   | /:id/topics          |
| PATCH  | /:id/topics/:topicId |
| DELETE | /:id/topics/:topicId |

---

### Submodule CRUD

| Method | Endpoint                               |
| ------ | -------------------------------------- |
| POST   | /:id/topics/:topicId/submodules        |
| PATCH  | /:id/topics/:topicId/submodules/:subId |
| DELETE | /:id/topics/:topicId/submodules/:subId |

---

### AI Content Generation

| Method | Endpoint                                                       | Description            |
| ------ | -------------------------------------------------------------- | ---------------------- |
| POST   | /:pathId/topics/:topicId/generate-content                      | Generate topic content |
| POST   | /:pathId/topics/:topicId/submodules/:submoduleId/generate-quiz | Generate quiz          |

---

### Progress Tracking

| Method | Endpoint                                                  |
| ------ | --------------------------------------------------------- |
| PATCH  | /:pathId/topics/:topicId/submodules/:submoduleId/complete |

---

### Reordering

| Method | Endpoint                                |
| ------ | --------------------------------------- |
| PATCH  | /:id/reorder-topics                     |
| PATCH  | /:id/topics/:topicId/reorder-submodules |

---

### Notebook Cell CRUD

| Method | Endpoint                                                          |
| ------ | ----------------------------------------------------------------- |
| POST   | /:pathId/topics/:topicId/submodules/:submoduleId/cells            |
| PATCH  | /:pathId/topics/:topicId/submodules/:submoduleId/cells/:cellIndex |
| DELETE | /:pathId/topics/:topicId/submodules/:submoduleId/cells/:cellIndex |

---

# AI Service Communication

Backend communicates with the AI microservice using Axios.

Implemented services:

```text
generateLearningPath()
generateTopicContent()
generateMiniQuiz()
```

Example flow:

```text
Client Request
      │
      ▼
Express Controller
      │
      ▼
Axios Request → FastAPI AI Service
      │
      ▼
AI Generated Response
      │
      ▼
MongoDB Save
      │
      ▼
Response to Frontend
```

---

# Progress Calculation

Learning progress is recalculated automatically.

### Topic Progress

```text
completedSubmodules / totalSubmodules × 100
```

### Overall Progress

```text
completedSubmodulesAcrossPath / totalSubmodules × 100
```

When progress reaches:

```text
100%
```

Learning path status becomes:

```text
completed
```

---

# CORS Configuration

Configured to allow frontend access:

```javascript
cors({
  origin: "http://localhost:5173",
  credentials: true,
});
```

---

# Contribution

This project was developed collaboratively as part of a team project.

### My Contributions

#### Profile Management Module

Implemented:

- Signup
- Login
- JWT Authentication
- Cookie-based auth flow
- Update profile
- Change password
- Delete account
- User stats
- Leaderboard

#### Learning Path Module

Implemented:

- Learning path CRUD
- Topic CRUD
- Submodule CRUD
- Topic content generation
- Mini quiz generation
- Notebook cell system
- Progress tracking
- Reordering system
- AI service integration

---

# Future Improvements

- Role-based access
- Redis caching
- API rate limiting
- Refresh token mechanism
- Swagger/OpenAPI documentation
- Docker support
- CI/CD pipeline
- Cloud deployment

---

# License

This project is intended for educational and portfolio purposes.
