# Cluster Blob

A small API to handle media for the Cluster application, which you can see in my profile (now its currently private). The point is, a storage that uses the filesystem and generates random id's that will point to the correct file, automatically handling an returning the image.
upload and retrieve media files. It supports various file types and includes rate limiting, authorization, and size validation.

Endpoints
GET /blob/:type/:uuid
Retrieve a media file by its type and UUID.

Parameters
type (string): The type of the file (e.g., png, jpg, mp4).
uuid (string): The unique identifier of the file.
size (optional, query string): The size of the image to be resized (e.g., 800x600).
Responses
200 OK: Returns the requested file.
400 Bad Request: Invalid file type or size parameter.
404 Not Found: File not found.
500 Internal Server Error: Error processing the image.
Example Request
POST /blob/:type
Upload a new media file.

Parameters
type (string): The type of the file (e.g., png, jpg, mp4).
Request Body
data (string): The base64-encoded data of the file.
Headers
Authorization (string): The authorization token.
Responses
200 OK: File uploaded successfully.
400 Bad Request: Missing data field or invalid file type.
401 Unauthorized: Invalid authorization header.
500 Internal Server Error: Error writing the file.
Example Request
Helper Functions
generateRandomUUID
Generates a random UUID.

isValidType
Checks if the provided file type is valid.

verifyAuthorization
Verifies the provided authorization token.

Environment Variables
PRIVATE_KEY: The private key used for authorization.
HOSTNAME: The hostname of the server.
PORT: The port on which the server runs.
Middleware
rateLimit: Limits the number of requests from a single IP.
morgan: Logs HTTP requests.
bodyParser: Parses incoming request bodies.
express-range: Adds support for HTTP Range requests.
sharp: Processes images.
Example .env File
Running the Server
To start the server, run:

The server will be available at http://localhost:3000.
