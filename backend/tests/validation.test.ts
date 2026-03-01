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
  setVerificationQuestionsSchema,
} from '../src/middleware/validation';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Response;
  let mockNext: NextFunction;

  // typed mocks you can assert on
  let statusMock: jest.MockedFunction<Response['status']>;
  let jsonMock: jest.MockedFunction<Response['json']>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a real-ish Response object with only the pieces we need
    const res: Partial<Response> = {};

    jsonMock = jest.fn(() => res as Response) as unknown as jest.MockedFunction<Response['json']>;
    statusMock = jest.fn(() => res as Response) as unknown as jest.MockedFunction<Response['status']>;

    res.json = jsonMock;
    res.status = statusMock;

    mockResponse = res as Response;

    mockNext = jest.fn() as unknown as NextFunction;

    mockRequest = { body: {} };
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

    // After the logic refactor (migration 007), verification questions are no longer
    // required on lost items — the finder sets them on the claim instead.

    it('should pass with valid lost item data', () => {
      mockRequest.body = {
        category: 'PHONE',
        title: 'Lost iPhone 14',
        description: 'Black iPhone 14 Pro with blue case',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid category', () => {
      mockRequest.body = {
        category: 'INVALID',
        title: 'Lost Item',
        description: 'Description that is long enough',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject short title', () => {
      mockRequest.body = {
        category: 'PHONE',
        title: 'Hi',
        description: 'Description of the item that is long enough',
        location_area: 'Kimironko',
        lost_date: '2024-01-15',
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('setVerificationQuestionsSchema', () => {
    const middleware = validate(setVerificationQuestionsSchema);

    it('should pass with exactly 3 valid questions', () => {
      mockRequest.body = {
        questions: [
          { question: 'What is the lockscreen?', answer: 'Mountain photo' },
          { question: 'What color is the case?', answer: 'Black' },
          { question: 'What app is on the home screen?', answer: 'Spotify' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject fewer than 3 questions', () => {
      mockRequest.body = {
        questions: [
          { question: 'What is the lockscreen?', answer: 'Mountain photo' },
        ],
      };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject more than 3 questions', () => {
      mockRequest.body = {
        questions: [
          { question: 'What is the lockscreen?', answer: 'Mountain photo' },
          { question: 'What color is the case?', answer: 'Black' },
          { question: 'What app is on the home screen?', answer: 'Spotify' },
          { question: 'What is the PIN length?', answer: 'six digits' },
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