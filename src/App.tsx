/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Web Chat Application - Homework Project</h1>
        <p className="text-gray-600 mb-6">
          This project has been generated according to your requirements. It is a full-stack application containing a Node.js/Express backend, a React/Vite frontend, and a PostgreSQL database, all orchestrated with Docker Compose.
        </p>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-left">
          <h2 className="font-semibold mb-2">How to run this project:</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Click the <strong>Settings / Export</strong> menu in AI Studio.</li>
            <li>Download the project as a ZIP file and extract it.</li>
            <li>Open a terminal in the extracted folder.</li>
            <li>Run <code>docker compose up --build</code></li>
            <li>Open <code>http://localhost:80</code> in your browser.</li>
          </ol>
        </div>
        <p className="text-sm text-gray-500">
          Note: The AI Studio preview cannot run Docker Compose directly, which is why you see this instruction page instead of the app.
        </p>
      </div>
    </div>
  );
}
