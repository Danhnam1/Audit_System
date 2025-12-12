# Audit Manager System

A comprehensive web-based audit management system built with React, TypeScript, and Vite. This system provides a complete solution for managing audit processes, findings, corrective actions, and preventive actions (CAPA) across different organizational departments.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Build](#build)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

## ✨ Features

### Core Functionality
- **Audit Planning & Management**: Create, review, and manage audit plans
- **Team Management**: Assign auditors and manage audit teams
- **Finding Management**: Track and document audit findings
- **CAPA Management**: Manage Corrective and Preventive Actions
- **Evidence Management**: Upload and review audit evidence
- **Reporting**: Generate comprehensive audit reports
- **Real-time Notifications**: SignalR-based real-time updates
- **Archive History**: Access historical audit data

### Role-Based Features
- **Admin**: User management, department management, criteria management, checklist management, backup/restore
- **Lead Auditor**: Audit planning, team assignment, audit review, report generation
- **Auditor**: Audit execution, finding documentation, evidence collection
- **Auditee Owner**: Evidence review, CAPA management, task assignment
- **CAPA Owner**: Action tracking, deadline management, evidence upload
- **Director**: Audit plan approval, results review, summary reports

## 🚀 Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **React Router DOM** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **Zustand** - State management
- **React Query** - Server state management
- **SignalR** - Real-time communication
- **Recharts** - Data visualization
- **GSAP** - Animations
- **DND Kit** - Drag and drop functionality
- **React Toastify** - Toast notifications
- **React Icons** - Icon library

### Development Tools
- **ESLint** - Code linting
- **TypeScript ESLint** - TypeScript-specific linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 👥 User Roles

The system supports multiple user roles with specific permissions:

1. **Admin** - Full system administration
2. **Lead Auditor** - Lead audit planning and team management
3. **Auditor** - Execute audits and document findings
4. **Auditee Owner** - Department representatives managing evidence
5. **CAPA Owner** - Manage corrective and preventive actions
6. **Director** - Review and approve audit plans and results

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.x or higher recommended)
- **npm** (comes with Node.js) or **yarn**
- A modern web browser (Chrome, Firefox, Edge, Safari)

## 🔧 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Danhnam1/Audit_System.git
   cd Audit_System
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## 🛠️ Development

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the application:**
   Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal)

3. **Development features:**
   - Hot Module Replacement (HMR) for instant updates
   - API proxy configured to forward `/api` requests to the backend
   - TypeScript type checking
   - ESLint for code quality

## 🏗️ Build

### Production Build

Build the application for production:

```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Bundle and optimize all assets
- Generate optimized production files in the `dist/` directory
- Include necessary configuration files (web.config, .htaccess)

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

### Linting

Check code quality:

```bash
npm run lint
```

## 🚀 Deployment

The application can be deployed to various platforms:

### IIS (Windows Server)

For detailed IIS deployment instructions, see:
- [DEPLOY.md](./DEPLOY.md) - General deployment guide
- [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) - Build and deployment with API fixes
- [IIS_SETUP_FINAL.md](./IIS_SETUP_FINAL.md) - Final IIS setup guide

Quick steps:
1. Build the project: `npm run build`
2. Install IIS URL Rewrite Module
3. Upload `dist/` folder contents to IIS website directory
4. Ensure `web.config` is in the root directory
5. Configure Application Pool (No Managed Code, Integrated Pipeline)
6. Restart IIS

### Apache Server

For Apache deployment:
1. Build the project: `npm run build`
2. Upload `dist/` folder contents to your web server
3. Ensure `.htaccess` file is present (included in build)
4. Enable `mod_rewrite` module
5. Restart Apache

### Nginx Server

For Nginx deployment:
1. Build the project: `npm run build`
2. Use `nginx.conf.example` as a template
3. Configure server blocks and proxy settings
4. Upload `dist/` folder contents
5. Restart Nginx

For more details, see [DEPLOY.md](./DEPLOY.md)

## 📁 Project Structure

```
Audit_System/
├── public/              # Static assets
├── src/
│   ├── api/            # API client configuration
│   ├── components/     # Reusable UI components
│   ├── config/         # Application configuration
│   ├── constants/      # Application constants
│   ├── contexts/       # React contexts (Auth, SignalR)
│   ├── features/       # Feature-specific components
│   ├── helpers/        # Helper functions
│   ├── hooks/          # Custom React hooks
│   ├── layouts/        # Layout components
│   ├── pages/          # Page components
│   │   ├── Admin/      # Admin pages
│   │   ├── Auditor/    # Auditor pages
│   │   ├── AuditeeOwner/ # Auditee Owner pages
│   │   ├── CAPAOwner/  # CAPA Owner pages
│   │   ├── Director/   # Director pages
│   │   ├── LeadAuditor/ # Lead Auditor pages
│   │   ├── Auth/       # Authentication pages
│   │   └── Shared/     # Shared pages
│   ├── routes/         # Application routing
│   ├── services/       # Business logic services
│   ├── store/          # State management (Zustand)
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Root application component
│   └── main.tsx        # Application entry point
├── dist/               # Production build output (generated)
├── node_modules/       # Dependencies (generated)
├── .gitignore          # Git ignore rules
├── eslint.config.js    # ESLint configuration
├── index.html          # HTML entry point
├── package.json        # Project dependencies and scripts
├── postcss.config.js   # PostCSS configuration
├── tailwind.config.js  # TailwindCSS configuration
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── README.md           # This file
```

## 🔐 Environment Variables

The application uses the following environment variables:

### Required Variables

- `VITE_API_BASE_URL` - Base URL for API requests
  - Default: `https://moca.mom/api`
  - Example: `https://your-api-server.com/api`

- `VITE_API_PROXY_TARGET` - Proxy target for development server
  - Default: `https://moca.mom`
  - Example: `https://your-api-server.com`

### Setting Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=https://your-api-server.com/api
VITE_API_PROXY_TARGET=https://your-api-server.com
```

**Note:** Environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support and questions, please contact the development team.

## 🔗 Additional Documentation

- [Deployment Guide](./DEPLOY.md) - Comprehensive deployment instructions
- [Build and Deploy Guide](./BUILD_AND_DEPLOY.md) - Build process and API configuration
- [IIS Setup Guide](./IIS_SETUP_FINAL.md) - Windows IIS deployment
- [API 404 Debug Guide](./DEBUG_404_API.md) - Troubleshooting API issues
- [API 404 Fix Guide](./FIX_404_API.md) - Solutions for API 404 errors
- [Deploy IIS Fix](./DEPLOY_IIS_FIX.md) - IIS deployment troubleshooting
- [Solution Final](./SOLUTION_FINAL.md) - Final solution documentation

---

**Built with ❤️ by the Audit System Team**
