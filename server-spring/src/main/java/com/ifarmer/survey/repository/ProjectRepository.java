package com.ifarmer.survey.repository;

import com.ifarmer.survey.model.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {

    @Query("SELECT DISTINCT p FROM ProjectEntity p LEFT JOIN FETCH p.versions ORDER BY p.updatedAt DESC")
    List<ProjectEntity> findAllWithVersions();

    @Query("SELECT p FROM ProjectEntity p LEFT JOIN FETCH p.versions WHERE p.id = :id")
    Optional<ProjectEntity> findByIdWithVersions(@Param("id") String id);
}
