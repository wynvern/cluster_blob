const express = require("express");
const app = express();
const fs = require("node:fs");
const path = require("node:path");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const morgan = require("morgan");
const range = require("express-range");
const sharp = require("sharp");

const acceptedTypes = ["png", "gif", "mp4", "pdf", "txt", "jpg", "jpeg", "webp", "svg", "mp3", "wav", "flac", "ogg", "docx", "ppt"];
const mimeTypeMap = {
	png: "image/png",
	gif: "image/gif",
	mp4: "video/mp4",
	pdf: "application/pdf",
	txt: "text/plain",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	svg: "image/svg+xml",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	flac: "audio/flac",
	ogg: "audio/ogg",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	ppt: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
  let size = req.query.size; // Get the size parameter from the query string

  if (size > 8000 || size < 0) {
	res.status(400).send("The size parameter is invalid. The maximum size is 8000");
	return;
  }

  if (!isValidType(type)) {
    res
      .status(400)
      .send(
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

  // Parse the size parameter
  let width, height;
  if (size) {
    [width, height] = size.split("x").map((dim) => parseInt(dim, 10) || null);
  }

  if (width || height) {
    // Resize the image with sharp
    sharp(filePath)
      .resize(width, height) // This maintains aspect ratio if one of the dimensions is null
      .toBuffer()
      .then((data) => {
        res.writeHead(200, {
          "Content-Type": mimeTypeMap[type],
          "Content-Length": data.length,
        });
        res.end(data);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error processing image");
      });
  } else {
    // Existing logic for serving the file without resizing
    let range = req.headers.range;
    if (!range) range = "bytes=0-";

    const fileSize = fs.statSync(filePath).size;
    const positions = range.replace(/bytes=/, "").split("-");
    const start = parseInt(positions[0], 10);
    const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;

    if (range) {
      const readStream = fs.createReadStream(filePath, { start, end });

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

	if (!fs.existsSync(path.join(__dirname, "public", type))) {
		fs.mkdirSync(path.join(__dirname, "public", type), { recursive: true });
	}

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
