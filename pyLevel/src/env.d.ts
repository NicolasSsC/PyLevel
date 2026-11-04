declare namespace App {
  interface Locals {
    adminUser?: import('./lib/db').UserProfile;
    sessionUser?: import('./lib/db').UserProfile | null;
  }
}
