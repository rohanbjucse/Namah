const cors = require("cors");
const fs = require("fs");
const path = require("path");

const express = require("express");

const app = express();

app.use(cors());
app.use(express.json());

/*const ropes = {
  ROPE001: {
    model: "Namah 8.4 Dynamic",
    diameter: 8.4,
    status: "ACTIVE",
    inspections: [],
    falls: []
  },
  ROPE002: {
    model: "Namah 10.2 Gym",
    diameter: 10.2,
    status: "INSPECTION_DUE",
    inspections: [],
    falls: []
  }
};*/

const dataFilePath = path.join(__dirname, "../data.json");


function loadData() {
  if (!fs.existsSync(dataFilePath)) {
    const initialData = { ropes: {} };
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  const rawData = fs.readFileSync(dataFilePath);
  return JSON.parse(rawData);
}


function saveData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

let data = loadData();
let ropes = data.ropes;


const ALLOWED_FALL_TYPES = [
  "LEAD",
  "TOP_ROPE",
  "UNKNOWN"
];


const ALLOWED_STATUSES = [
  "ACTIVE",
  "INSPECTION_DUE",
  "RETIRED"
];
const ALLOWED_INSPECTION_RESULTS = [
  "PASS",
  "MONITOR",
  "FAIL"
];

app.get("/", (req, res) => {
  res.send("Rope ID backend is running");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.get("/rope/:nfcUid", (req, res) => {
  const nfcUid = req.params.nfcUid;
  console.log("NFC UID received:", nfcUid);
  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

 /* res.json({
    nfcUid: nfcUid,
    model: rope.model,
    diameter: rope.diameter,
    status: rope.status,
    manufactureDate: rope.manufactureDate,
    batchNumber: rope.batchNumber,
    uiaaFallsRating: rope.uiaaFallsRating
  });*/
  res.json(rope);

});

app.post("/rope/:nfcUid/status", (req, res) => {
  const nfcUid = req.params.nfcUid;
  const newStatus = req.body.status;

  console.log("Status update request:", nfcUid, newStatus);

  const rope = ropes[nfcUid];
if (rope.status === "RETIRED") {
  return res.status(403).json({
    error: "Rope is retired and cannot be modified"
  });
}

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  if (!newStatus) {
    return res.status(400).json({
      error: "Status is required"
    });
  }
if (!ALLOWED_STATUSES.includes(newStatus)) {
  return res.status(400).json({
    error: "Invalid status",
    allowedStatuses: ALLOWED_STATUSES
  });
}

  rope.status = newStatus;
  saveData({ ropes });


  res.json({
    message: "Rope status updated",
    rope: {
      nfcUid: nfcUid,
    model: rope.model,
    diameter: rope.diameter,
    status: rope.status,
    manufactureDate: rope.manufactureDate,
    batchNumber: rope.batchNumber,
    uiaaFallsRating: rope.uiaaFallsRating
    }
  });
});


app.post("/test", (req, res) => {
  console.log("Request body received:", req.body);

  res.json({
    received: req.body
  });
});
app.post("/rope/:nfcUid/inspection", (req, res) => {
  const nfcUid = req.params.nfcUid;
  const { result, remarks } = req.body;

  console.log("Inspection received:", nfcUid, result);

  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  if (rope.status === "RETIRED") {
    return res.status(403).json({
      error: "Cannot inspect a retired rope"
    });
  }

  if (!ALLOWED_INSPECTION_RESULTS.includes(result)) {
    return res.status(400).json({
      error: "Invalid inspection result",
      allowedResults: ALLOWED_INSPECTION_RESULTS
    });
  }

  const inspection = {
    result: result,
    remarks: remarks || "",
    date: new Date().toISOString()
  };

  rope.inspections.push(inspection);
  saveData({ ropes });


  // Minimal business logic

  if (result === "FAIL") {
    rope.status = "RETIRED";
  } else if (result === "MONITOR") {
    rope.status = "INSPECTION_DUE";
  } else if (result === "PASS") {
    rope.status = "ACTIVE";
  }

  res.json({
    message: "Inspection recorded",
    ropeStatus: rope.status,
    inspection: inspection
  });
});

app.get("/rope/:nfcUid/inspections", (req, res) => {
  const nfcUid = req.params.nfcUid;

  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  res.json({
    nfcUid: nfcUid,
    inspections: rope.inspections
  });
});

app.post("/rope/:nfcUid/fall", (req, res) => {
  const nfcUid = req.params.nfcUid;
  const { type, notes } = req.body;

  console.log("Fall event received:", nfcUid, type);

  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  if (rope.status === "RETIRED") {
    return res.status(403).json({
      error: "Cannot log fall on a retired rope"
    });
  }

  if (!ALLOWED_FALL_TYPES.includes(type)) {
    return res.status(400).json({
      error: "Invalid fall type",
      allowedTypes: ALLOWED_FALL_TYPES
    });
  }

  const fall = {
    type: type,
    notes: notes || "",
    date: new Date().toISOString()
  };

  rope.falls.push(fall);
  saveData({ ropes });


  // Minimal safety rule:
  rope.status = "INSPECTION_DUE";

  res.json({
    message: "Fall event recorded",
    ropeStatus: rope.status,
    fall: fall
  });
});
app.get("/rope/:nfcUid/falls", (req, res) => {
  const nfcUid = req.params.nfcUid;

  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  res.json({
    nfcUid: nfcUid,
    falls: rope.falls
  });
});
//total rope overview

app.get("/rope/:nfcUid/overview", (req, res) => {
  const nfcUid = req.params.nfcUid;
  const rope = ropes[nfcUid];

  if (!rope) {
    return res.status(404).json({
      error: "Rope not found"
    });
  }

  const lastInspection =
    rope.inspections.length > 0
      ? rope.inspections[rope.inspections.length - 1]
      : null;

  res.json({
    nfcUid: nfcUid,
    model: rope.model,
    diameter: rope.diameter,
    status: rope.status,
    manufactureDate: rope.manufactureDate,
    batchNumber: rope.batchNumber,
    uiaaFallsRating: rope.uiaaFallsRating,
    totalFalls: rope.falls.length,
    lastInspection: lastInspection
  });
});

module.exports = app;

