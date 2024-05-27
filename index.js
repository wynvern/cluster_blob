const express = require("express");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
const bodyParser = require("body-parser");

const acceptedTypes = ["png", "gif"];

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
	if (authToken !== process.env.PRIVATE_KEY) return false;
	return true;
}

/*
   data: Buffer
   auth
*/

app.get("/:type/:uuid", (req, res) => {
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

app.post("/:type", (req, res) => {
	const type = req.params.type;
	const uuid = generateRandomUUID();
	const data = Buffer.from(req.body.data, "base64");
	const filePath = path.join(__dirname, "public", type, `${uuid}.png`);

	if (!isValidType(type)) {
		res.status(400).send(
			`The file type is invalid. Supported types are: ${acceptedTypes}`
		);
		return false;
	}

	if (!verifyAuthorization(req.header.authorization)) {
		res.status(401).send("The authorization header is invalid");
	}

	fs.writeFile(filePath, data, (err) => {
		if (err) {
			console.error(err);
			res.status(500).send("Error writing file");
		} else {
			res.send("File saved successfully");
		}
	});
});

app.listen(3001, () => {
	console.log("Server is running on port 3001");
});
