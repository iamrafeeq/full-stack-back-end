// models/MaintenanceRequest.js

import mongoose, { Schema } from "mongoose";



const maintenanceSchema = new Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issue: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved'],
    default: 'open'
  }
}, { timestamps: true });

// module.exports = mongoose.model('', maintenanceSchema);

const MaintenanceRequestModel = mongoose.model("MaintenanceRequest", maintenanceSchema);


export default MaintenanceRequestModel;