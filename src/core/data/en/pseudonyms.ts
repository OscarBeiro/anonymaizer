// English pseudonym pools; same shape as ../es/pseudonyms.ts.

// Common English given names, mixed gender.
export const GIVEN_NAMES: readonly string[] = [
  'Emily', 'James', 'Olivia', 'Thomas', 'Sophie', 'Daniel', 'Hannah', 'Oliver', 'Charlotte', 'William',
  'Grace', 'Henry', 'Megan', 'Samuel', 'Lucy', 'George', 'Ella', 'Benjamin', 'Amelia', 'Jack',
  'Chloe', 'Edward', 'Isabel', 'Matthew', 'Rachel', 'Andrew', 'Laura', 'Joseph', 'Alice', 'Peter',
  'Hazel', 'Nathan', 'Anna', 'Christopher', 'Eleanor', 'Adam', 'Rebecca', 'Michael', 'Claire', 'Simon',
  'Natalie', 'Patrick', 'Kate', 'Robert', 'Victoria', 'Alexander', 'Jessica', 'Richard', 'Maya', 'David',
];

// Common English surnames.
export const SURNAMES: readonly string[] = [
  'Carter', 'Smith', 'Taylor', 'Brown', 'Wilson', 'Davies', 'Evans', 'Walker', 'Wright', 'Robinson',
  'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Lewis', 'Martin',
  'Jackson', 'Clarke', 'Clark', 'Turner', 'Hill', 'Scott', 'Cooper', 'Morris', 'Ward', 'Moore',
  'King', 'Watson', 'Baker', 'Harrison', 'Morgan', 'Patel', 'Young', 'Allen', 'Mitchell', 'James',
  'Anderson', 'Phillips', 'Lee', 'Bell', 'Parker', 'Collins', 'Bennett', 'Foster', 'Hayes', 'Marshall',
];

// Company names are built "<lead> <tail>", then the original legal suffix.
export const COMPANY_LEADS: readonly string[] = [
  'Northbridge', 'Harbour', 'Summit', 'Oakwood', 'Bluestone', 'Ironside', 'Redfern', 'Silverline',
  'Greenfield', 'Westmoor', 'Brightwater', 'Stonegate', 'Kingsway', 'Ashford', 'Lakeside',
];

export const COMPANY_TAILS: readonly string[] = [
  'Holdings', 'Partners', 'Solutions', 'Consulting', 'Logistics', 'Industries', 'Group', 'Services',
  'Systems', 'Trading', 'Capital', 'Technologies', 'Estates', 'Engineering', 'Supplies',
];

// Appended when the original company name carries no legal suffix.
export const DEFAULT_COMPANY_SUFFIX: string = 'Ltd';
