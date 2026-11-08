import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'code'>('password');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('POST', '/api/login', { username, password });
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setLocation('/');
    } catch (err: any) {
      toast({ title: 'Login Failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          {loginMethod === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} disabled={showCodeInput} />
              {!showCodeInput ? (
                <Button className="w-full" onClick={async () => {
                  await fetch('/api/request-login-code', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email }) });
                  setShowCodeInput(true);
                }}>Send Code</Button>
              ) : (
                <>
                  <Input placeholder="Enter 6-digit code" value={code} onChange={e => setCode(e.target.value)} />
                  <Button className="w-full" onClick={async () => {
                    const res = await fetch('/api/verify-login-code', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email, code }) });
                    if (res.ok) { await queryClient.invalidateQueries({ queryKey: ['/api/user'] }); setLocation('/'); }
                    else toast({ title: "Error", description: "Invalid code", variant: "destructive" });
                  }}>Verify & Login</Button>
                </>
              )}
            </div>
          )}
          <Button variant="ghost" className="w-full mt-2" onClick={() => setLoginMethod(m => m === 'password' ? 'code' : 'password')}>
            Switch to {loginMethod === 'password' ? 'Email Code' : 'Password'} Login
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account? <Link href="/register" className="text-primary hover:underline">Create Account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
