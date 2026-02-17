/**
 * Validation Middleware Tests
 * Tests for request validation schemas
 */

import { Request, Response, NextFunction } from 'express';
import {
  validate,
  registerSchema,
  loginSchema,
  createLostItemSchema,
  createFoundItemSchema,
  createClaimSchema,
  verifyClaimSchema,
  sendMessageSchema,
} from '../src/middleware/validation';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    mockNext = jest.fn();
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };
    mockRequest = {
      body: {},
    };
  });

  describe('registerSchema', () => {
    const middleware = validate(registerSchema);

    it('should pass with valid registration data', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
        phone: '+250788123456',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass without optional phone', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid email', () => {
      mockRequest.body = {
        email: 'invalid-email',
        password: 'Password123!',
        name: 'Test User',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject short password', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject empty name', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
        name: '',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('loginSchema', () => {
    const middleware = validate(loginSchema);

    it('should pass with valid login data', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject missing email', () => {
      mockRequest.body = {
        password: 'Password123!',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject missing password', () => {
      mockRequest.body = {
        email: 'test@example.com',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('createLostItemSchema', () => {
    const middleware = validate(createLostItemSchema);

    it('should pass with valid lost item data', () => {
      mockRequest.body = {
        category: 'PHONE',
        title: 'Lost iPhone 14',
        description: 'Black iPhone 14 Pro with blue case',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
        verification_questions: [
          { question: 'What is the lockscreen?', answer: 'Mountain photo' },
          { question: 'Phone color?', answer: 'Black' },
          { question: 'Case color?', answer: 'Blue' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid category', () => {
      mockRequest.body = {
        category: 'INVALID',
        title: 'Lost Item',
        description: 'Description',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
        verification_questions: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
          { question: 'Q3?', answer: 'A3' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject missing verification questions', () => {
      mockRequest.body = {
        category: 'PHONE',
        title: 'Lost iPhone',
        description: 'Description',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
        verification_questions: [
          { question: 'Q1?', answer: 'A1' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject short title', () => {
      mockRequest.body = {
        category: 'PHONE',
        title: 'Hi',
        description: 'Description of the item',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
        verification_questions: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
          { question: 'Q3?', answer: 'A3' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('createFoundItemSchema', () => {
    const middleware = validate(createFoundItemSchema);

    it('should pass with valid found item data', () => {
      mockRequest.body = {
        category: 'WALLET',
        title: 'Found Brown Wallet',
        description: 'Brown leather wallet with cards',
        location_area: 'Remera',
        found_date: '2024-01-15',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass with optional cooperative_id', () => {
      mockRequest.body = {
        category: 'WALLET',
        title: 'Found Wallet at Bus Station',
        description: 'Brown leather wallet',
        location_area: 'Nyabugogo',
        found_date: '2024-01-15',
        cooperative_id: 1,
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid category', () => {
      mockRequest.body = {
        category: 'INVALID',
        title: 'Found Item',
        description: 'Description',
        location_area: 'Remera',
        found_date: '2024-01-15',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('createClaimSchema', () => {
    const middleware = validate(createClaimSchema);

    it('should pass with valid claim data', () => {
      mockRequest.body = {
        lost_item_id: 1,
        found_item_id: 2,
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject missing lost_item_id', () => {
      mockRequest.body = {
        found_item_id: 2,
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject non-integer ids', () => {
      mockRequest.body = {
        lost_item_id: 'abc',
        found_item_id: 2,
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('verifyClaimSchema', () => {
    const middleware = validate(verifyClaimSchema);

    it('should pass with valid answers array', () => {
      mockRequest.body = {
        answers: ['answer1', 'answer2', 'answer3'],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject wrong number of answers', () => {
      mockRequest.body = {
        answers: ['answer1', 'answer2'],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject empty answers', () => {
      mockRequest.body = {
        answers: ['', 'answer2', 'answer3'],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('sendMessageSchema', () => {
    const middleware = validate(sendMessageSchema);

    it('should pass with valid message', () => {
      mockRequest.body = {
        content: 'Hello, I think this is my phone!',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject empty message', () => {
      mockRequest.body = {
        content: '',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject too long message', () => {
      mockRequest.body = {
        content: 'a'.repeat(2001),
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});