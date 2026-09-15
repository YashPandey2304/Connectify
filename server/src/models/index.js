/**
 * MODEL REGISTRY
 *
 * Requiring a Mongoose model file for the first time is what registers
 * its schema with Mongoose. If a model is only ever referenced indirectly
 * (e.g., Conversation.js has `ref: "Message"`, but nothing actually
 * `require`s models/Message.js), Mongoose won't know what "Message" means
 * once a populate() call tries to resolve that reference — which is
 * exactly the bug we hit.
 *
 * Requiring every model here, and requiring THIS file once at server
 * startup, guarantees all schemas are registered before any request
 * comes in — regardless of which controller/service happens to run first.
 */
require("./User");
require("./Conversation");
require("./Message");
