# NEON / NOTES

A personal blogging application with a futuristic dark interface, mint accents, and responsive layouts. Built as a web-development capstone while learning Node.js, Express, and EJS.

## Features

- Create posts with a title and body.
- View posts newest first on the homepage.
- Edit existing posts and delete individual entries.
- Responsive writing panel and feed, with a matching edit page.
- Escaped EJS output, visible keyboard focus, and reduced-motion support.

## Stack

Node.js · Express · EJS · HTML · CSS

## Run locally

Requires Node.js 24 or newer and npm.

```bash
git clone https://github.com/kingrodham/neon-notes.git
cd neon-notes
npm ci
npm start
```

Open http://localhost:3000. For automatic restarts during development:

```bash
npm run dev
```

## Project structure

```text
index.js           Express middleware, routes, and in-memory posts
views/index.ejs    Homepage, publishing form, and post feed
views/edit.ejs     Edit form with existing post values
public/styles.css Responsive theme and component styling
```

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | / | Display the homepage |
| POST | /posts | Create a post |
| GET | /posts/:id/edit | Open the edit form |
| POST | /posts/:id/edit | Update a post |
| POST | /posts/:id/delete | Delete a post |

## Data and scope

Posts are stored in server memory, not a database. Refreshing the browser preserves them; restarting the server clears them. There are no user accounts or per-user data separation: all visitors share the same posts. This is a learning/portfolio demo, not a production publishing platform.

GitHub hosts the source code. Running the live application requires a Node.js server; GitHub Pages alone cannot run Express.

## Manual verification

1. Create two posts and check that both appear.
2. Edit one and verify there is no duplicate.
3. Cancel an edit and confirm the saved text is unchanged.
4. Delete one post and verify the other remains.
5. Check the homepage and edit form at desktop and mobile widths.

## Learning focus

Express routing and middleware, HTML form submission, EJS data passing, array-based CRUD operations, and responsive CSS. Developed with AI assistance for explanations, debugging, and visual design.
