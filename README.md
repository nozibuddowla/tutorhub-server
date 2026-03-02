# TutorHub — Server

> REST API backend for the TutorHub platform. Handles authentication, tuition management, applications, payments, real-time messaging, and session scheduling.

[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=nodedotjs)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)](https://mongodb.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Database Collections](#database-collections)

---

## Features

- **JWT authentication** — cookie-based session tokens with role verification middleware
- **Role-based authorization** — Admin, Tutor, Student route guards
- **Tuition CRUD** — post, browse, filter, approve/reject tuitions
- **Application system** — tutors apply, students review and approve/reject
- **Stripe payments** — create payment intents, webhook handling, payment history
- **Real-time messaging** — Socket.io rooms per conversation
- **Session scheduling** — create, update, and query upcoming class sessions
- **Review system** — star ratings and written reviews per tutor
- **Admin controls** — manage all users, tuitions, and platform payments

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | MongoDB (Native Driver) |
| Real-time | Socket.io |
| Payments | Stripe |
| Auth | JWT + HTTP-only Cookies |
| CORS | cors middleware |

---

## Project Structure

```
server/
├── index.js              # Entry point — Express app + Socket.io setup
├── .env                  # Environment variables (not committed)
├── .env.example          # Environment variable template
└── package.json
```

All route handlers and business logic live in `index.js` organized by feature section. As the project grows, consider splitting into:

```
routes/
├── auth.js
├── tuitions.js
├── applications.js
├── payments.js
├── sessions.js
└── admin.js
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/nozibuddowla/tutorhub-server.git
cd tutorhub-server

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# → Fill in your values (see Environment Variables below)

# Start development server
npm run dev       # uses nodemon for hot reload
# or
node index.js     # production start
```

Server runs at `http://localhost:5000` by default.

---

## Environment Variables

Create a `.env` file in the root:

```env
# Server
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/tutorhub

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

> **Never commit your `.env` file.** It is already in `.gitignore`.

---

## API Reference

### Auth

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/auth/login` | Issue JWT cookie on login | Public |
| `POST` | `/auth/logout` | Clear JWT cookie | Auth |
| `GET` | `/auth/me` | Get current user role | Auth |

---

### Users

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/users` | Create or upsert user on signup | Public |
| `GET` | `/users/:email/role` | Get user role | Public |

---

### Tuitions

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/tuitions/all` | List tuitions (search, filter, paginate) | Public |
| `GET` | `/tuitions/:id` | Get single tuition details | Public |
| `POST` | `/tuitions` | Post a new tuition | Student |
| `PATCH` | `/tuitions/:id/status` | Approve or reject a tuition | Admin |
| `GET` | `/student/tuitions/:email` | Get student's own tuitions | Student |

**Query parameters for `GET /tuitions/all`:**

```
?search=mathematics
&subject=Physics
&location=Dhaka
&status=approved
&sort=salaryHigh       # salaryLow | salaryHigh
&page=1
&limit=6
```

---

### Applications

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/applications` | Submit a tuition application | Tutor |
| `GET` | `/tutor/applications/:email` | Get tutor's applications | Tutor |
| `GET` | `/student/applications/:email` | Get applications for student's tuitions | Student |
| `PATCH` | `/applications/:id` | Edit a pending application | Tutor |
| `PATCH` | `/applications/:id/status` | Approve or reject application | Student |
| `DELETE` | `/applications/:id` | Delete a pending application | Tutor |

---

### Ongoing Tuitions

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/tutor/ongoing/:email` | Get tutor's approved/ongoing tuitions | Tutor |
| `GET` | `/student/applied-tutors/:email` | Get student's hired tutors | Student |

---

### Sessions (Calendar)

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/sessions/upcoming/:email` | Get upcoming sessions for a user | Auth |
| `POST` | `/sessions` | Create a new session | Auth |
| `PATCH` | `/sessions/:id` | Update session status | Auth |
| `DELETE` | `/sessions/:id` | Delete a session | Auth |

---

### Messaging

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/conversations` | Create or retrieve a conversation | Auth |
| `GET` | `/conversations/:email` | Get all conversations for a user | Auth |
| `GET` | `/messages/:conversationId` | Get messages in a conversation | Auth |
| `POST` | `/messages` | Send a message | Auth |

Real-time delivery is handled by **Socket.io**. When a message is sent via `POST /messages`, the server also emits to the relevant Socket.io room.

---

### Payments

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/create-payment-intent` | Create Stripe payment intent | Student |
| `POST` | `/payments` | Record a completed payment | Student |
| `GET` | `/tutor/revenue/:email` | Get tutor's payment history | Tutor |
| `GET` | `/admin/payments` | Get all platform payments | Admin |

---

### Reviews

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/reviews` | Submit a review for a tutor | Student |
| `GET` | `/reviews/:tutorEmail` | Get reviews for a tutor | Public |

---

### Admin

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/admin/users` | Get all users | Admin |
| `PATCH` | `/admin/users/:id/role` | Change a user's role | Admin |
| `DELETE` | `/admin/users/:id` | Delete a user | Admin |
| `GET` | `/admin/tuitions` | Get all tuitions | Admin |
| `GET` | `/admin/payments` | Get all payments | Admin |

---

### Tutors

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/tutors` | Get all tutors (with avg rating) | Public |
| `GET` | `/tutors/:id` | Get single tutor profile | Public |

---

## Authentication

The server uses **JWT stored in HTTP-only cookies** for authentication.

**Login flow:**
1. Client authenticates with Firebase (Google OAuth)
2. Client sends `POST /auth/login` with the Firebase ID token
3. Server verifies the token, looks up the user role in MongoDB
4. Server issues a signed JWT as an HTTP-only `Set-Cookie`
5. All subsequent requests send the cookie automatically

**Protected routes** use a `verifyToken` middleware:

```js
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.user = decoded;
    next();
  });
};
```

**Role verification** layers on top:

```js
const verifyAdmin = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.user.email });
  if (user?.role !== "admin") return res.status(403).send({ message: "Forbidden" });
  next();
};
```

---

## Database Collections

| Collection | Description |
|---|---|
| `users` | All registered users with role field (`admin`, `tutor`, `student`) |
| `tuitions` | Tuition posts with status (`pending`, `approved`, `rejected`) |
| `applications` | Tutor applications for tuitions with status tracking |
| `payments` | Payment records linked to tuition and student/tutor emails |
| `sessions` | Scheduled class sessions with start/end times and status |
| `conversations` | Messaging threads between a tutor and student |
| `messages` | Individual messages belonging to a conversation |
| `reviews` | Tutor reviews with star rating, linked by tutorEmail |

### Key Indexes (recommended)

```js
// Fast user lookups
usersCollection.createIndex({ email: 1 }, { unique: true });

// Tuition filtering
tuitionsCollection.createIndex({ status: 1, subject: 1, location: 1 });

// Application queries
applicationsCollection.createIndex({ tutorEmail: 1 });
applicationsCollection.createIndex({ studentEmail: 1 });

// Session queries
sessionsCollection.createIndex({ tutorEmail: 1, startTime: 1 });
sessionsCollection.createIndex({ studentEmail: 1, startTime: 1 });

// Message retrieval
messagesCollection.createIndex({ conversationId: 1, createdAt: 1 });
```