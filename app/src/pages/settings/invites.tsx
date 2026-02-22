import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function InvitesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/settings/users", { replace: true });
  }, [navigate]);

  return null;
}
