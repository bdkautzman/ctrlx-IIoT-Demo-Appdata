module.exports = function (RED) {
  const name = "pdfbuilder";
  RED.nodes.registerType(name, pdfbuilder);
  function pdfbuilder(config) {
    const node = this;
    const pdfMake = require("pdfmake/build/pdfmake.js");
    pdfMake.vfs = require("./vfs_fonts.js");

    RED.nodes.createNode(this, config);

    this.on("input", function (msg, nodeSend, nodeDone) {
      try {
        function handleError(error, text) {
          text = parseText(text);
          node.error(RED._(`${name}.errors.${error}`), msg);
          node.status({ fill: "red", shape: "dot", text: `Error. ${text}` });
          nodeDone();
        }

        let docDefinition = RED.util.getMessageProperty(
          msg,
          config.inputProperty
        );
        let options = RED.util.getMessageProperty(msg, config.options);
        let outputProperty = config.outputProperty;
        let outputType = config.outputType;

        const pdfDocGenerator = pdfMake.createPdf(docDefinition, options);
        if (outputType === "base64") {
          pdfDocGenerator
            .getBase64()
            .then((base64) => {
              RED.util.setMessageProperty(msg, outputProperty, base64);
              nodeSend(msg);
            })
            .catch((error) => {
              handleError("create_pdf", error.message);
            });
        } else if (outputType === "Buffer") {
          pdfDocGenerator
            .getBuffer()
            .then((buffer) => {
              RED.util.setMessageProperty(
                msg,
                outputProperty,
                Buffer.from(buffer)
              );
              nodeSend(msg);
            })
            .catch((error) => {
              handleError("create_pdf", error.message);
            });
        } else {
          handleError(
            "unknown_output_type",
            "Unknown output type. This should never happen`"
          );
        }
      } catch (error) {
        handleError("internal", error);
      }
    });

    this.on('close', function () {
      node.status({});
    });
  }
};

function parseText(text) {
  if (typeof text === "string") {
    if (text.includes("Row data")) {
      text = text.split("Row data")[0];
    } else
    if (text.includes("Cannot create property")) {
      text = "Wrong input data type";
    } else
    if (text.includes("Cannot read properties")) {
      text = "Malformed input data";
    }
  }
  return text;
}
