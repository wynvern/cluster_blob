const express = require("express");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const morgan = require("morgan");
const range = require("express-range");

const acceptedTypes = ["png", "gif", "mp4"];
const mimeTypeMap = {
	png: "image/png",
	gif: "image/gif",
	mp4: "video/mp4",
};
const limiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 500,
	message: "Too many requests from this IP, please try again later.",
});

app.use(range());
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
	if (authToken !== process.env.PRIVATE_KEY || !authToken) return false;
	return true;
}

app.get("/blob/:type/:uuid", async (req, res) => {
	const uuid = req.params.uuid;
	const type = req.params.type;

	if (!isValidType(type)) {
		res.status(400).send(
			`The file type is invalid. Supported types are: ${acceptedTypes.join(
				", "
			)}`
		);
		return;
	}

	const filePath = path.join(__dirname, "public", type, `${uuid}.${type}`);

	if (!fs.existsSync(filePath)) {
		res.status(404).send("File not found");
		return;
	}

	let range = req.headers.range;
	if (!range) range = "bytes=0-";

	const fileSize = fs.statSync(filePath).size;
	const positions = range.replace(/bytes=/, "").split("-");
	const start = Number.parseInt(positions[0], 10);
	const end = positions[1] ? Number.parseInt(positions[1], 10) : fileSize - 1;

	if (range) {
		const readStream = fs.createReadStream(filePath, {
			start: start,
			end: end,
		});

		readStream.on("error", () => {
			res.status(404).send("File not found");
		});

		res.writeHead(206, {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": end - start + 1,
			"Content-Type": mimeTypeMap[type],
		});
		readStream.pipe(res);
	} else {
		const readStream = fs.createReadStream(filePath);

		readStream.on("error", () => {
			res.status(404).send("File not found");
		});

		res.writeHead(200, {
			"Content-Length": fileSize,
			"Content-Type": mimeTypeMap[type],
		});
		readStream.pipe(res);
	}
});

app.post("/blob/:type", async (req, res) => {
	const type = req.params.type;
	const uuid = generateRandomUUID();

	if (!req.body.data) {
		res.status(400).send("The data field is required");
		return false;
	}

	const data = Buffer.from(req.body.data, "base64");
	const filePath = path.join(__dirname, "public", type, `${uuid}.${type}`);

	if (!isValidType(type)) {
		res.status(400).send(
			`The file type is invalid. Supported types are: ${acceptedTypes.join(
				", "
			)}`
		);
		return false;
	}

	if (!verifyAuthorization(req.headers.authorization)) {
		res.status(401).send("The authorization header is invalid");
		return false;
	}

	console.log("Data: ", data);

	try {
		fs.writeFileSync(filePath, data);
		res.status(200).json({
			uuid,
			type,
			urlToMedia: `http://${process.env.HOSTNAME}:${process.env.PORT}/blob/${type}/${uuid}`,
			status: "success",
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Error writing file");
	}
});

app.listen(process.env.PORT, () => {
	console.log(
		`Server is running on ${process.env.HOSTNAME}:${process.env.PORT}`
	);
});
