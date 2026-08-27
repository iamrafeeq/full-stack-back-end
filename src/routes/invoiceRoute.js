import express from "express";
import {
  getInvoices,
  getInvoiceById,
  downloadInvoice,
  generateInvoice,
  markInvoicePaid,
} from "../controller/invoice/invoiceController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const InvoiceRoute = express.Router();

// Staff-only actions
InvoiceRoute.post(  "/generate",        protect, authenticateRole("admin", "manager", "receptionist"), generateInvoice);
InvoiceRoute.patch( "/markpaid/:id",    protect, authenticateRole("admin", "manager", "receptionist"), markInvoicePaid);

// All authenticated users — controller filters by ownership for "user" role
InvoiceRoute.get("/",              protect, getInvoices);
InvoiceRoute.get("/:id/download",  protect, downloadInvoice);
InvoiceRoute.get("/:id",           protect, getInvoiceById);

export default InvoiceRoute;
