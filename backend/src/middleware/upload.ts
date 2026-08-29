import multer from 'multer';
import { Request } from 'express';

// 1. Configure multer to use ephemeral memory buffers rather than writing to disk
const storage = multer.memoryStorage();

// 2. Correctly typed MIME-type filtering using modern Multer declarations
const fileFilter = (
  req: Request, 
  file: Express.Multer.File, 
  callback: multer.FileFilterCallback
) => {
  if (file.mimetype === 'application/pdf') {
    callback(null, true);
  } else {
    callback(new Error('Invalid file format. Only structural PDF files (.pdf) are permitted.'));
  }
};

// 3. Export the custom configured upload engine instance
export const uploadResume = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Hard stop at 5 Megabytes to protect server memory allocation
  }
});
