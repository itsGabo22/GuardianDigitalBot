SELECT id,
       user_id,
       message_content,
       analysis_result,
       was_helpful,
       "timestamp"
FROM public.feedback
LIMIT 1000;