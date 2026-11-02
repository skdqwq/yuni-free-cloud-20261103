/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.web.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig
implements WebMvcConfigurer {
    private final AuthInterceptor authInterceptor;

    public WebConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor((HandlerInterceptor)this.authInterceptor).addPathPatterns(new String[]{"/api/**"}).excludePathPatterns(new String[]{"/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/health", "/api/scripts"});
    }

    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/m").setViewName("forward:/index.html");
        registry.addViewController("/m/").setViewName("forward:/index.html");
        registry.addViewController("/m/**").setViewName("forward:/index.html");
    }
}

