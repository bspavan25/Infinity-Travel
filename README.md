# Infinity-Travel

Infinity Travel is a travel booking platform enabling users to search for flights and manage their favorite destinations. This project is developed using Node.js, Express, SQLite, and EJS.

### Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)

### Setting Up the Development Environment

#### 1. Clone the Repository

Clone the repository to your local machine.

```shell
git clone https://github.com/bspavan25/Infinity-Travel.git
cd Infinity-Travel
```

#### 2. Install Dependencies

Install the required node modules. You need Node.js and npm installed for this step.

```shell
npm install
```

#### 3. Install Nodemon (Optional)

Nodemon is a utility that monitors for any changes in your source and automatically restarts your server. It is very useful for development to reflect changes instantly.

To install Nodemon globally, run:

```shell
npm install -g nodemon
```

#### 4. Start the Development Server

You can start the server using the `start` script included in the `package.json` file.

```shell
npm start
```

The application will start, and you can access it at `http://localhost:3000`.

### Database Migration

The project uses SQLite as a database. When you first run the application, it checks if the required tables are present in the database. If not, it creates them automatically, so you don't need to run any additional scripts.

### Contribution Guidelines

1. **Fork and Clone the Repository**
   - Fork the project repository.
   - Clone it to your local machine.

```shell
git clone https://github.com/yourusername/Infinity-Travel.git
cd Infinity-Travel
```

Replace `'https://github.com/yourusername/Infinity-Travel.git'` with the actual forked repository URL.

2. **Create a New Branch**
   - Create a new branch for each feature or bug fix to keep the work modular.

```shell
git checkout -b feature/yourfeaturename
```

3. **Make Your Changes**
   - Make your changes and test them locally.
4. **Commit Your Changes**
   - Commit your changes with a meaningful commit message.

```shell
git add .
git commit -m "Your detailed commit message"
```

5. **Push to Your Fork**
   - Push your changes to your fork on GitHub.

```shell
git push origin feature/yourfeaturename
```

6. **Create a Pull Request**
   - Go to your fork on GitHub and create a pull request from there.
   - Ensure to pull the latest changes from the original repository before making a pull request.
