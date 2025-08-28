SELECT id,
       user_id,
       original_message,
       analysis_result,
       was_helpful,
       created_at
FROM public.feedback
LIMIT 1000;