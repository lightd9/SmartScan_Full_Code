SmartScan: Blockchain-Integrated Mobile App for Authenticating Medicines and Consumer Goods
Overview

SmartScan is a blockchain-powered mobile application designed to combat counterfeit products by enabling users to verify the authenticity of medicines and consumer goods. The system leverages QR code scanning and decentralized blockchain records to ensure end-to-end product traceability across the supply chain.

Key Features

Blockchain-Based Authentication: Ensures product data integrity using smart contracts on the Ethereum (Sepolia) testnet.

QR Code Scanning: Users can scan unique product codes to instantly verify authenticity.

Role-Based Access: Distinct dashboards and permissions for Admins, Manufacturers, Suppliers, and Retailers.

Product Tracking: Trace a product’s lifecycle from production to retail distribution.

Local Storage Integration: Maintains scan history for offline access and quick reference.

Web & Mobile Friendly: Developed with a responsive React frontend and a Node.js/Express backend.

System Architecture

Frontend: React + Vite

Backend: Node.js + Express

Database: PostgreSQL

Blockchain: Solidity Smart Contract (Deployed on Sepolia Testnet)


Installation & Setup
Prerequisites

Node.js (v18 or higher)

npm or yarn

PostgreSQL

ngrok (for temporary backend tunneling during development)

1. Clone the Repository
git clone https://github.com/lightd9/SmartScan_Full_Code.git
cd SmartScan_Full_Code

2. Backend Setup
cd smartscan-backend-node
npm install
node postgres.js   # Initialize or test database connection
npm start          # Start backend server


(Optional: Run ngrok to expose backend for external access)

ngrok http 5000

3. Frontend Setup

Open a new terminal:

cd smartscan-frontend-react
npm install
npm start


Your app will run locally at:
http://localhost:3000

Environment Variables

Create a .env file in both the backend and frontend directories:

Backend .env
PORT=5000
DATABASE_URL=your_postgres_connection_string
BLOCKCHAIN_API_URL=https://sepolia.infura.io/v3/your_api_key
PRIVATE_KEY=your_wallet_private_key

Frontend .env
REACT_APP_API_URL=http://localhost:5000


If using ngrok:

REACT_APP_API_URL=https://<your-ngrok-id>.ngrok-free.app


Author
Olafenwa Hassan

Final Year Computer Science Project — 2025

University Project: SmartScan: A Blockchain-Integrated Mobile App for Authenticating Medicines and Consumer Goods
