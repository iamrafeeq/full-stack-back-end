import express from "express";
import {
  createTable,
  getTables,
  getTableById,
  updateTable,
  deactivateTable,
  activateTable,
  deleteTable,
} from "../controller/table/tableController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const TableRoute = express.Router();

TableRoute.use(protect);

// Any authenticated user — browse tables
TableRoute.get("/",    getTables);
TableRoute.get("/:id", getTableById);

// Admin + Manager — CRUD
TableRoute.post("/",                  authenticateRole("admin", "manager"), createTable);
TableRoute.put("/:id",                authenticateRole("admin", "manager"), updateTable);
TableRoute.put("/:id/deactivate",     authenticateRole("admin", "manager"), deactivateTable);
TableRoute.put("/:id/activate",       authenticateRole("admin", "manager"), activateTable);
TableRoute.delete("/:id",             authenticateRole("admin", "manager"), deleteTable);

export default TableRoute;
