-- 남촌축산백화점: 기존 products/admin_users 테이블 유지, 부족한 기능만 추가
-- Supabase SQL Editor에서 실행하세요. 관리자 UID를 다시 등록할 필요는 없습니다.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,
  enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_settings, public.notices, public.popups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings, public.notices, public.popups TO authenticated;

-- 관리자 확인은 기존 admin_users 테이블을 기준으로 합니다.
CREATE OR REPLACE FUNCTION public.namchon_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.admin_users
  WHERE user_id = (SELECT auth.uid())
) $$;
REVOKE ALL ON FUNCTION public.namchon_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.namchon_is_admin() TO authenticated;

-- 관리자는 숨긴 상품도 편집할 수 있어야 합니다.
DROP POLICY IF EXISTS "Namchon admins can read all products" ON public.products;
CREATE POLICY "Namchon admins can read all products" ON public.products
FOR SELECT TO authenticated USING ((SELECT public.namchon_is_admin()));

DROP POLICY IF EXISTS "Namchon public settings" ON public.site_settings;
CREATE POLICY "Namchon public settings" ON public.site_settings
FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Namchon admins insert settings" ON public.site_settings;
CREATE POLICY "Namchon admins insert settings" ON public.site_settings
FOR INSERT TO authenticated WITH CHECK ((SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins update settings" ON public.site_settings;
CREATE POLICY "Namchon admins update settings" ON public.site_settings
FOR UPDATE TO authenticated USING ((SELECT public.namchon_is_admin()))
WITH CHECK ((SELECT public.namchon_is_admin()));

DROP POLICY IF EXISTS "Namchon public notices" ON public.notices;
CREATE POLICY "Namchon public notices" ON public.notices
FOR SELECT TO anon, authenticated USING (visible OR (SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins insert notices" ON public.notices;
CREATE POLICY "Namchon admins insert notices" ON public.notices
FOR INSERT TO authenticated WITH CHECK ((SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins update notices" ON public.notices;
CREATE POLICY "Namchon admins update notices" ON public.notices
FOR UPDATE TO authenticated USING ((SELECT public.namchon_is_admin()))
WITH CHECK ((SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins delete notices" ON public.notices;
CREATE POLICY "Namchon admins delete notices" ON public.notices
FOR DELETE TO authenticated USING ((SELECT public.namchon_is_admin()));

DROP POLICY IF EXISTS "Namchon public popups" ON public.popups;
CREATE POLICY "Namchon public popups" ON public.popups
FOR SELECT TO anon, authenticated USING (enabled OR (SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins insert popups" ON public.popups;
CREATE POLICY "Namchon admins insert popups" ON public.popups
FOR INSERT TO authenticated WITH CHECK ((SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins update popups" ON public.popups;
CREATE POLICY "Namchon admins update popups" ON public.popups
FOR UPDATE TO authenticated USING ((SELECT public.namchon_is_admin()))
WITH CHECK ((SELECT public.namchon_is_admin()));
DROP POLICY IF EXISTS "Namchon admins delete popups" ON public.popups;
CREATE POLICY "Namchon admins delete popups" ON public.popups
FOR DELETE TO authenticated USING ((SELECT public.namchon_is_admin()));
