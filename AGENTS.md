<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Delivery authentication and recovery reuse the existing client in src/lib/supabase.ts; generated Cloud clients must not replace it because delivery records belong to the existing external project.
- Centralize delivery account checks and auth calls in src/lib/delivery-auth.ts so login and recovery enforce the same access rule.
- Recovery links returning to the public home page are forwarded with their hash to the public /reset-password page before auth initialization so recovery cannot open the delivery screen.
