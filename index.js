const express = require("express");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const morgan = require("morgan");

const acceptedTypes = ["png", "gif"];
const limiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 500,
	message: "Too many requests from this IP, please try again later.",
});

app.use(morgan("tiny"));
app.use(limiter);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
	bodyParser.urlencoded({
		limit: "50mb",
		extended: true,
		parameterLimit: 50000,
	})
);
app.use(express.json());

function generateRandomUUID() {
	return (
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15)
	);
}

function isValidType(type) {
	if (!acceptedTypes.includes(type)) return false;

	return true;
}

function verifyAuthorization(authToken) {
	console.log(authToken);

	if (authToken !== process.env.PRIVATE_KEY || !authToken) return false;
	return true;
}

/*
   data: Buffer
   auth
*/

app.get("/blob/:type/:uuid", (req, res) => {
	const uuid = req.params.uuid;
	const type = req.params.type;
	const filePath = path.join(__dirname, "public", type, `${uuid}.png`);

	if (!isValidType(type)) return false;

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.status(404).send("File not found");
		} else {
			res.writeHead(200, { "Content-Type": "image/png" });
			res.end(data);
		}
	});
});

app.post("/blob/:type", (req, res) => {
	const type = req.params.type;
	const uuid = generateRandomUUID();

	if (!req.body.data) {
		res.status(400).send("The data field is required");
		return false;
	}

	const data = Buffer.from(req.body.data, "base64");
	const filePath = path.join(__dirname, "public", type, `${uuid}.png`);

	if (!isValidType(type)) {
		res.status(400).send(
			`The file type is invalid. Supported types are: ${acceptedTypes}`
		);
		return false;
	}

	if (!verifyAuthorization(req.headers.authorization)) {
		res.status(401).send("The authorization header is invalid");
		return false;
	}

	fs.writeFile(filePath, data, (err) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error writing file");
		} else {
			res.json({
				uuid: uuid,
				urlToMedia: `http://${process.env.HOSTNAME}:${process.env.PORT}/blob/${type}/${uuid}`,
				status: "success",
			});
		}
	});
});

app.listen(process.env.PORT, () => {
	console.log(`Server is running on port ${process.env.PORT}`);
});
