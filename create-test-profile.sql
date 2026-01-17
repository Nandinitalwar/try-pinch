-- Create test user profile for memory testing
INSERT INTO user_profiles (
    phone_number, 
    preferred_name,
    birth_date, 
    birth_time,
    birth_time_known,
    birth_city, 
    birth_country
) VALUES (
    '15551234567',
    'Alex', 
    '1995-05-15',
    '14:30:00',
    true,
    'New York', 
    'USA'
) ON CONFLICT (phone_number) DO UPDATE SET
    preferred_name = EXCLUDED.preferred_name,
    birth_date = EXCLUDED.birth_date,
    birth_time = EXCLUDED.birth_time,
    birth_city = EXCLUDED.birth_city,
    birth_country = EXCLUDED.birth_country;