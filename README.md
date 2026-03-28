## ✨ Key Features

  * **Secure Auth:** User registration and login powered by **JWT** (JSON Web Tokens).
  * **Dynamic Rooms:** Support for both **Public** and **Private** chat spaces.
  * **Real-Time Engine:** Instant messaging and live updates via **Socket.io**.
  * **Presence Tracking:** See who’s **Online**, **AFK**, or **Offline** in real-time.
  * **Social Tools:** Manage a friends list and engage in **Direct Messaging (DMs)**.
  * **Rich Media:** Share more than just text with **File & Image attachments**.

-----

## 🛠️ Tech Stack

### **Frontend**

  * **React 18** (UI Library) & **TypeScript** (Type Safety)
  * **Tailwind CSS** (Styling)
  * **Zustand** (State Management)
  * **Vite** (Build Tool)

### **Backend & Database**

  * **Node.js & Express** (Server)
  * **Prisma** (ORM) & **PostgreSQL** (Primary Database)
  * **Redis** (Caching & Presence)
  * **Socket.io** (WebSockets)

### **Infrastructure**

  * **Docker & Docker Compose** (Containerization)

-----

## 🚀 Getting Started

Getting the app up and running is straightforward thanks to Docker.

### **Prerequisites**

Ensure you have **Docker** and **Docker Compose** installed on your machine.

### **Installation**

1.  **Clone the repository** to your local machine.
2.  Open your terminal in the root directory and run:
    ```bash
    docker compose up --build
    ```
3.  Once the containers are active, open your browser and head to:
    > **[http://localhost:80](https://www.google.com/search?q=http://localhost:80)**

-----

## 🔑 Permissions & Roles

  * **First Come, First Served:** The user who creates a chat room is automatically assigned as the **Owner/Admin**.
  * **New Users:** Simply register through the UI to get started\!

-----

## 📂 Project Structure

  * `/frontend` - React application source code.
  * `/backend` - Express server, Prisma schemas, and logic.
  * `docker-compose.yml` - Orchestration for the app, DB, and Redis.

-----

