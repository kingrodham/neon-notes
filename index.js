import express from "express";


const app = express();
const port = 3000;
const posts = [];
let nextID = 1;

//Tell express to use ejs templates
app.set("view engine", "ejs");

//Make public folder available to the browser
app.use(express.static("public"));

//Read Data sent by html forms
app.use(express.urlencoded ({extended: true}));

// Display Homepage
app.get("/", (req, res) => {
    res.render("index.ejs", { posts: posts });
})

app.post("/posts", (req,res) =>{
    const title = req.body.title.trim();
    const content = req.body.content.trim();

    if (!title || !content) {
        return res.status(400).send("Please enter a title and content");
    }
    const post ={
        id:nextID,
        title:title,
        content:content
    };
    posts.push(post);
    nextID ++;
    res.redirect("/")
});

app.post("/posts/:id/delete", (req, res) => {
    const id = Number(req.params.id);

    const postIndex = posts.findIndex(function (post) {
        return post.id === id;
    });

    if (postIndex === -1) {
        return res.status(404).send("Post not found.");
    }

    posts.splice(postIndex, 1);

    res.redirect("/");
});

app.get("/posts/:id/edit", (req, res) => {
    const id = Number(req.params.id);

    const post = posts.find(function (post) {
        return post.id === id;
    });

    if (!post) {
        return res.status(404).send("Post not found.");
    }

    res.render("edit.ejs", { post: post });
});

app.post("/posts/:id/edit", (req, res) => {
    const id = Number(req.params.id);

    const post = posts.find(function (post) {
        return post.id === id;
    });

    if (!post) {
        return res.status(404).send("Post not found.");
    }

    const title =
        typeof req.body.title === "string" ? req.body.title.trim() : "";

    const content =
        typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!title || !content) {
        return res.status(400).send("Please enter a title and content.");
    }

    post.title = title;
    post.content = content;

    res.redirect("/");
});
// Start the server 
app.listen(port,  () => {
    console.log(`Server is running at port ${port}`);
});

