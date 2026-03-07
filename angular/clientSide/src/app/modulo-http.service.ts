import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModuloHttpService { 
  
  constructor(private http: HttpClient) { }

   loginAsUser(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/user', user);
  }

   loginAsDoctor(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/doctor', user);
  }

   loginAsAdmin(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/admin', user); // da verificare endpoint
  }
}
