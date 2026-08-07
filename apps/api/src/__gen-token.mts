import { encode } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET!;
const sub = process.argv[2];

const token = await encode({
  token: { sub, name: "Test User" },
  secret,
  maxAge: 60 * 60,
});

console.log(token);
